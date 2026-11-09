import { describe, expect, it } from 'vitest'

import {
  bitsToOctal,
  bitsToSymbol,
  defaultGroups,
  defaultSpecialBits,
  fileNameToSafeShellToken,
  getFullModeString,
  getModeExplanation,
  getOctalMode,
  getPermissionSummary,
  parseOctalMode,
  parsePermissionDigit,
  parseSymbolicMode,
} from './permissions'

describe('Permission bit conversions', () => {
  it.each([
    [0, { read: false, write: false, execute: false }],
    [1, { read: false, write: false, execute: true }],
    [2, { read: false, write: true, execute: false }],
    [3, { read: false, write: true, execute: true }],
    [4, { read: true, write: false, execute: false }],
    [5, { read: true, write: false, execute: true }],
    [6, { read: true, write: true, execute: false }],
    [7, { read: true, write: true, execute: true }],
  ])('parses octal digit %i', (digit, expected) => {
    expect(parsePermissionDigit(digit)).toEqual(expected)
  })

  it('converts permission bits to octal', () => {
    expect(bitsToOctal(defaultGroups.owner)).toBe(7)
    expect(bitsToOctal(defaultGroups.group)).toBe(5)
    expect(bitsToOctal(defaultGroups.others)).toBe(0)
  })

  it('converts permission bits to symbolic notation', () => {
    expect(bitsToSymbol(defaultGroups.owner)).toBe('rwx')
    expect(bitsToSymbol(defaultGroups.group)).toBe('r-x')
    expect(bitsToSymbol(defaultGroups.others)).toBe('---')
  })
})

describe('Permission mode generation', () => {
  it('generates file and directory permission strings', () => {
    expect(
      getFullModeString(defaultGroups, defaultSpecialBits, 'file'),
    ).toBe('-rwxr-x---')

    expect(
      getFullModeString(defaultGroups, defaultSpecialBits, 'directory'),
    ).toBe('drwxr-x---')
  })

  it('generates octal mode strings with special bits', () => {
    expect(
      getOctalMode(defaultGroups, {
        setuid: true,
        setgid: true,
        sticky: true,
      }),
    ).toBe('7750')
  })

  it('represents special bits correctly when execute is disabled', () => {
    const groups = {
      owner: { read: true, write: true, execute: false },
      group: { read: true, write: false, execute: false },
      others: { read: false, write: false, execute: false },
    }

    const special = {
      setuid: true,
      setgid: true,
      sticky: true,
    }

    expect(getFullModeString(groups, special, 'file')).toBe('-rwSr-S--T')
  })
})

describe('Octal mode parsing', () => {
  it('parses standard octal permissions', () => {
    const result = parseOctalMode('755')

    expect(result.valid).toBe(true)
    expect(result.octal).toBe('755')
    expect(bitsToOctal(result.permissions.owner)).toBe(7)
    expect(bitsToOctal(result.permissions.group)).toBe(5)
    expect(bitsToOctal(result.permissions.others)).toBe(5)
    expect(result.special).toEqual(defaultSpecialBits)
  })

  it('parses octal permissions containing special bits', () => {
    const result = parseOctalMode('4755')

    expect(result.valid).toBe(true)
    expect(result.special).toEqual({
      setuid: true,
      setgid: false,
      sticky: false,
    })
    expect(getOctalMode(result.permissions, result.special)).toBe('4755')
  })

  it('accepts whitespace around valid input', () => {
    expect(parseOctalMode(' 755 ').valid).toBe(true)
  })

  it.each(['888', '99', '12345', 'abc', ''])(
    'rejects invalid octal input: %s',
    (value) => {
      expect(parseOctalMode(value).valid).toBe(false)
    },
  )
})

describe('Symbolic mode parsing', () => {
  it('parses standard symbolic permissions', () => {
    const result = parseSymbolicMode('rwxr-xr-x')

    expect(result.valid).toBe(true)
    expect(result.permissions.owner).toEqual({
      read: true,
      write: true,
      execute: true,
    })
    expect(result.permissions.group).toEqual({
      read: true,
      write: false,
      execute: true,
    })
    expect(result.permissions.others).toEqual({
      read: true,
      write: false,
      execute: true,
    })
  })

  it('accepts a directory type prefix', () => {
    const result = parseSymbolicMode('drwxr-xr-x')

    expect(result.valid).toBe(true)
  })

  it('parses setuid, setgid and sticky bits', () => {
    const result = parseSymbolicMode('-rwsr-Sr-t')

    expect(result.valid).toBe(true)
    expect(result.special).toEqual({
      setuid: true,
      setgid: true,
      sticky: true,
    })
  })

  it('rejects malformed symbolic permissions', () => {
    expect(parseSymbolicMode('-rwxr-x').valid).toBe(false)
    expect(parseSymbolicMode('invalid').valid).toBe(false)
  })
})

describe('Permission summaries and explanations', () => {
  it('generates permission summaries', () => {
    expect(getPermissionSummary(defaultGroups)).toEqual([
      'Owner: rwx (7)',
      'Group: r-x (5)',
      'Others: --- (0)',
    ])
  })

  it('explains directory permissions', () => {
    expect(
      getModeExplanation(defaultGroups, 'directory'),
    ).toContain('Directory execute permission allows traversal')
  })

  it('explains file permissions', () => {
    expect(
      getModeExplanation(defaultGroups, 'file'),
    ).toContain('This file can be opened or executed')
  })
})

describe('Safe shell filename handling', () => {
  it('leaves safe filenames unchanged', () => {
    expect(fileNameToSafeShellToken('report.txt')).toBe('report.txt')
  })

  it('quotes filenames containing spaces', () => {
    expect(fileNameToSafeShellToken('report file.txt')).toBe("'report file.txt'")
  })

  it('safely escapes embedded single quotes', () => {
    expect(fileNameToSafeShellToken("it's.txt")).toBe("'it'\"'\"'s.txt'")
  })

  it('handles empty filenames', () => {
    expect(fileNameToSafeShellToken('   ')).toBe("''")
  })
})
